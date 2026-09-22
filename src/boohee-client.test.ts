import assert from "node:assert/strict"
import test from "node:test"
import { BooheeClient } from "./boohee-client.js"
const client = new BooheeClient({
  userId: process.env.BOOHEE_USER_ID,
  apiKey: process.env.BOOHEE_API_KEY,
  accessToken: process.env.BOOHEE_ACCESS_TOKEN
})

test("searchFood sends the documented Boohee request", async () => {

  const searchFoodResult = await client.searchFood({
    keyword: "apple",
    page: 1,
    per_page: 10,
    sort: "calorie_asc",
    with_units: true
  })

  console.log('searchFoodResult', searchFoodResult)

  assert.equal(searchFoodResult.page, 1)
  assert.equal(searchFoodResult.foods.length, 10)

  const normalAppleCode = 'pingguo_junzhi'
  const searchFoodByCodeResult = await client.searchFoodByCode({
    code: normalAppleCode,
    with_ingredients: true,
    with_units: true,
    with_materials: true
  })

  console.log('searchFoodByCodeResult', searchFoodByCodeResult)

  assert.equal(searchFoodByCodeResult.code, normalAppleCode)

  console.log('compare end')
})

