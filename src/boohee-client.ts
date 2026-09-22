const BOOHEE_API_BASE_URL = "https://api.boohee.com/open-apis"

type BooheeResponse<T> = {
  code: number
  message: string
  data: T
}

export type BooheeCredentials = {
  userId?: string
  apiKey?: string
  accessToken?: string
}

export type SearchFood = {
  keyword: string
  barcode?: string
  page?: number
  per_page?: number
  sort?: 'calorie_asc' | 'calorie_desc'
  with_units?: boolean
}

export type SearchFoodResult = {
  page: number
  per_page: number
  has_more: boolean
  foods: Array<{
    code: string
    name: string
    calories: number
    protein: number
    fat: number
    carbohydrate: number
    health_light: 0 | 1 | 2 | 3 // 0 - none, 1 - green, 2 - yellow, 3 - red 
    is_liquid: boolean
    image_url: string
    unites: Array<{
      unit_id: number
      unit_name: string
      weight: string
      eat_weight: string
    }>
  }>
}

export type SearchFoodByCode = {
  code: string
  with_ingredients?: boolean
  with_units?: boolean
  with_materials?: boolean
}

export type SearchFoodByCodeResult = {
  code: string
  name: string
  health_light: number
  image_url: string
  food_weight_url: string
  is_liquid: boolean
  food_type: string
}


export type WeightRecord = {
  weightKg: number
  bodyFat?: number
  recordOn?: string
}

export type FoodRecord = {
  recordOn: string
  mealType: number
  foods: Array<{
    foodCode: string
    amount: number
    unitName: string
  }>
}

export class BooheeClient {
  constructor(
    private readonly credentials: BooheeCredentials,
    private readonly fetchImplementation: typeof fetch = fetch
  ) {
    if (!credentials.apiKey && !credentials.accessToken) {
      throw new Error("Set BOOHEE_API_KEY or BOOHEE_ACCESS_TOKEN before starting the server")
    }

    // if (!credentials.userId) {
    //   throw new Error("Set BOOHEE_USER_ID before starting the server")
    // }

    if (credentials.apiKey && credentials.accessToken) {
      throw new Error("Set only one of BOOHEE_API_KEY or BOOHEE_ACCESS_TOKEN")
    }
  }

  async searchFood(input: SearchFood): Promise<SearchFoodResult> {
    return this.request<SearchFoodResult>("GET", "/v1/food/search", {
      keyword: input.keyword,
      barcode: input.barcode,
      page: input.page,
      per_page: input.per_page,
      sort: input.sort,
      with_units: input.with_units
    })
  }

  async searchFoodByCode(input: SearchFoodByCode): Promise<SearchFoodByCodeResult> {
    return this.request<SearchFoodByCodeResult>("GET", "/v1/food/detail", {
      code: input.code,
      with_ingredients: input.with_ingredients,
      with_units: input.with_units,
      with_materials: input.with_materials
    })
  }

  async recordWeight(record: WeightRecord): Promise<unknown> {
    return this.request<unknown>("POST", "/v1/weight/record", {
      user_id: this.credentials.userId,
      weight: record.weightKg,
      body_fat: record.bodyFat,
      record_on: record.recordOn
    })
  }

  async recordFoods(record: FoodRecord): Promise<unknown> {
    return this.request<unknown>("POST", "/v2/eating/record", {
      user_id: this.credentials.userId,
      record_on: record.recordOn,
      meal_type: record.mealType,
      foods: record.foods.map((food) => ({
        food_code: food.foodCode,
        amount: food.amount,
        unit_name: food.unitName
      }))
    })
  }

  async getWeightRecords(input: {
    startDate: string
    endDate: string
    page?: number
    pageSize?: number
  }): Promise<unknown> {
    return this.request<unknown>("GET", "/v2/weight/records", {
      user_id: this.credentials.userId,
      start_date: input.startDate,
      end_date: input.endDate,
      page: input.page,
      page_size: input.pageSize
    })
  }

  async getFoodRecord(recordOn: string): Promise<SearchFoodResult> {
    return this.request<SearchFoodResult>("GET", "/v2/eating/records", {
      user_id: this.credentials.userId,
      record_on: recordOn
    })
  }

  private async request<T>(method: "GET" | "POST", path: string, parameters: Record<string, unknown>): Promise<T> {
    const url = new URL(`${BOOHEE_API_BASE_URL}${path}`)
    const request: RequestInit = {
      method,
      headers: {
        Accept: "application/json",
        ...this.authorizationHeader()
      }
    }

    if (method === "GET") {
      for (const [ key, value ] of Object.entries(removeUndefined(parameters))) {
        url.searchParams.set(key, String(value))
      }
    } else {
      request.headers = { ...request.headers, "Content-Type": "application/json" }
      request.body = JSON.stringify(removeUndefined(parameters))
    }

    const response = await this.fetchImplementation(url, request)

    const payload = await parseResponse<T>(response)
    if (!response.ok) {
      throw new Error(`Boohee API request failed (${response.status}): ${payload.message}`)
    }

    if (payload.code !== 0) {
      throw new Error(`Boohee API error ${payload.code}: ${payload.message}`)
    }

    return payload.data
  }

  private authorizationHeader(): Record<string, string> {
    return this.credentials.apiKey
      ? { "X-Api-Key": this.credentials.apiKey }
      : { Authorization: `Bearer ${this.credentials.accessToken}` }
  }
}

function removeUndefined(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(body).filter(([ , value ]) => value !== undefined))
}

async function parseResponse<T>(response: Response): Promise<BooheeResponse<T>> {
  try {
    return await response.json() as BooheeResponse<T>
  } catch {
    throw new Error("Boohee API returned an invalid JSON response")
  }
}
