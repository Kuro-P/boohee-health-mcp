#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"
import { BooheeClient } from "./boohee-client.js"

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
const positiveNumber = z.number().positive()
const page = z.number().int().min(1).optional()
const pageSize = z.number().int().min(1).max(100).optional()

// ========= Free API ======================
const foodSearchInput = z.object({
  keyword: z.string().min(1).max(30).describe("Search keyword, e.g. 'apple', 'rice'. Either keyword or barcode is required."),
  barcode: z.string().optional().describe("13-digit food barcode for specific food lookup. Either keyword or barcode is required."),
  page: z.number().int().optional().default(1).describe("Page number, default 1"),
  per_page: z.number().max(50).int().optional().default(20).describe("Items per page, default 20, maximum 50"),
  sort: z.enum(["calorie_asc", "calorie_desc"]).optional().describe("Sort method: calorie_asc for ascending calories, calorie_desc for descending calories, no sorting by default"),
  with_units: z.boolean().optional().default(false).describe("Whether to return units field data (most popular item ranked first), default false")
})

const foodDetailInput = z.object({
  code: z.string().describe("Food code, obtained from the food search API"),
  with_ingredients: z.boolean().optional().default(false).describe("Whether to return ingredients field data, default false"),
  with_units: z.boolean().optional().default(false).describe("Whether to return units field data, default false"),
  with_materials: z.boolean().optional().default(false).describe("Whether to return materials field data, default false"),
}) 


// ========= Non-free API======================
const weightInput = z.object({
  weight_kg: positiveNumber.max(500).describe("Body weight in kilograms"),
  body_fat_percent: z.number().min(0).max(100).optional().describe("Optional body fat percentage"),
  record_on: date.optional().describe("Date in YYYY-MM-DD. Boohee defaults to today when omitted")
})

const foodItem = z.object({
  food_code: z.string().trim().min(1).max(200).describe("Boohee food-library food code"),
  amount: positiveNumber.max(100000).describe("Consumed amount"),
  unit_name: z.string().trim().min(1).max(30).describe("Unit name, e.g. 克, 个, or 碗")
})

const foodInput = z.object({
  record_on: date.describe("Record date in YYYY-MM-DD"),
  meal_type: z.enum([ "breakfast", "lunch", "dinner", "snack", "morning_snack", "afternoon_snack", "evening_snack" ]).describe("Meal to record"),
  foods: z.array(foodItem).min(1).max(100).describe("One or more Boohee food-library foods")
})

const weightRecordsInput = z.object({
  start_date: date.describe("Start date in YYYY-MM-DD"),
  end_date: date.describe("End date in YYYY-MM-DD"),
  page: page.describe("Page number, default 1"),
  page_size: pageSize.describe("Results per page, default 20")
}).refine((input) => input.start_date <= input.end_date, {
  message: "start_date must not be after end_date"
})

const foodRecordInput = z.object({
  record_on: date.describe("Record date in YYYY-MM-DD")
})

const mealTypeCodes = {
  breakfast: 1,
  lunch: 2,
  dinner: 3,
  snack: 4,
  morning_snack: 6,
  afternoon_snack: 7,
  evening_snack: 8
} as const

const foodSearchInputSchema = {
  type: "object",
  properties: {
    keyword: { type: "string", minLength: 1, maxLength: 30, description: "Search keyword, e.g. 'apple', 'rice'. Either keyword or barcode is required." },
    barcode: { type: "string", description: "13-digit food barcode for specific food lookup. Either keyword or barcode is required." },
    page: { type: "integer", minimum: 1, default: 1, description: "Page number, default 1" },
    per_page: { type: "integer", minimum: 1, maximum: 50, default: 20, description: "Items per page, default 20, maximum 50" },
    sort: { type: "string", enum: [ "calorie_asc", "calorie_desc" ], description: "Sort method: calorie_asc for ascending calories, calorie_desc for descending calories, no sorting by default" },
    with_units: { type: "boolean", default: false, description: "Whether to return units field data (most popular item ranked first), default false" }
  },
  required: [ "keyword" ],
  additionalProperties: false
}

const foodDetailInputSchema = {
  type: "object",
  properties: {
    code: { type: "string", description: "Food code, obtained from the food search API" },
    with_ingredients: { type: "boolean", default: false, description: "Whether to return ingredients field data, default false" },
    with_units: { type: "boolean", default: false, description: "Whether to return units field data, default false" },
    with_materials: { type: "boolean", default: false, description: "Whether to return materials field data, default false" }
  },
  required: [ "code" ],
  additionalProperties: false
}

const weightInputSchema = {
  type: "object",
  properties: {
    weight_kg: { type: "number" },
    body_fat_percent: { type: "number" },
    record_on: { type: "string", description: "YYYY-MM-DD" }
  },
  required: [ "weight_kg" ],
  additionalProperties: false
}

const foodInputSchema = {
  type: "object",
  properties: {
    record_on: { type: "string", description: "YYYY-MM-DD" },
    meal_type: { type: "string", enum: [ "breakfast", "lunch", "dinner", "snack", "morning_snack", "afternoon_snack", "evening_snack" ] },
    foods: {
      type: "array",
      items: {
        type: "object",
        properties: {
          food_code: { type: "string" },
          amount: { type: "number" },
          unit_name: { type: "string" }
        },
        required: [ "food_code", "amount", "unit_name" ],
        additionalProperties: false
      }
    }
  },
  required: [ "record_on", "meal_type", "foods" ],
  additionalProperties: false
}

const weightRecordsInputSchema = {
  type: "object",
  properties: {
    start_date: { type: "string", description: "YYYY-MM-DD" },
    end_date: { type: "string", description: "YYYY-MM-DD" },
    page: { type: "integer", minimum: 1 },
    page_size: { type: "integer", minimum: 1, maximum: 100 }
  },
  required: [ "start_date", "end_date" ],
  additionalProperties: false
}

const foodRecordInputSchema = {
  type: "object",
  properties: {
    record_on: { type: "string", description: "YYYY-MM-DD" }
  },
  required: [ "record_on" ],
  additionalProperties: false
}

const client = new BooheeClient({
  userId: process.env.BOOHEE_USER_ID,
  apiKey: process.env.BOOHEE_API_KEY,
  accessToken: process.env.BOOHEE_ACCESS_TOKEN
})

const server = new Server(
  { name: "boohee-health-mcp", version: "0.2.0" },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_food",
      description: "Search for food in the Boohee food library",
      inputSchema: foodSearchInputSchema
    },
    {
      name: "search_food_by_code",
      description: "Get detailed information about a food item in the Boohee food library by its code",
      inputSchema: foodDetailInputSchema
    },
    {
      name: "record_weight",
      description: "Record the configured user's weight in Boohee",
      inputSchema: weightInputSchema
    },
    {
      name: "record_food",
      description: "Batch-record one meal using Boohee food-library food codes",
      inputSchema: foodInputSchema
    },
    {
      name: "get_weight_records",
      description: "Get the configured user's Boohee weight records for a date range",
      inputSchema: weightRecordsInputSchema
    },
    {
      name: "get_food_record",
      description: "Get the configured user's Boohee food record for one day",
      inputSchema: foodRecordInputSchema
    }
  ]
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case "saerch_food": {
        const input = foodSearchInput.parse(request.params.arguments ?? {})
        const data = await client.searchFood({
          keyword: input.keyword,
          barcode: input.barcode,
          page: input.page,
          per_page: input.per_page,
          sort: input.sort,
          with_units: input.with_units
        })
        return result("Food search results from Boohee", data)
      }
      case "search_food_by_code": {
        const input = foodDetailInput.parse(request.params.arguments ?? {})
        const data = await client.searchFoodByCode({
          code: input.code,
          with_ingredients: input.with_ingredients,
          with_units: input.with_units,
          with_materials: input.with_materials
        })
        return result("Food details from Boohee", data)
      }
      case "record_weight": {
        const input = weightInput.parse(request.params.arguments ?? {})
        const data = await client.recordWeight({
          weightKg: input.weight_kg,
          bodyFat: input.body_fat_percent,
          recordOn: input.record_on
        })
        return result("Weight recorded in Boohee", data)
      }
      case "record_food": {
        const input = foodInput.parse(request.params.arguments ?? {})
        const data = await client.recordFoods({
          recordOn: input.record_on,
          mealType: mealTypeCodes[input.meal_type],
          foods: input.foods.map((food) => ({
            foodCode: food.food_code,
            amount: food.amount,
            unitName: food.unit_name
          }))
        })
        return result("Food recorded in Boohee", data)
      }
      case "get_weight_records": {
        const input = weightRecordsInput.parse(request.params.arguments ?? {})
        const data = await client.getWeightRecords({
          startDate: input.start_date,
          endDate: input.end_date,
          page: input.page,
          pageSize: input.page_size
        })
        return result("Weight records retrieved from Boohee", data)
      }
      case "get_food_record": {
        const input = foodRecordInput.parse(request.params.arguments ?? {})
        const data = await client.getFoodRecord(input.record_on)
        return result("Food record retrieved from Boohee", data)
      }
      default:
        return failure(`Unknown tool: ${request.params.name}`)
    }
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join(" ")
      : error instanceof Error ? error.message : "Unexpected error"
    return failure(message)
  }
})

function result(message: string, data: unknown) {
  return {
    content: [ { type: "text" as const, text: JSON.stringify({ message, data }, null, 2) } ]
  }
}

function failure(message: string) {
  return {
    content: [ { type: "text" as const, text: message } ],
    isError: true
  }
}

await server.connect(new StdioServerTransport())
