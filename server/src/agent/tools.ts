import { z } from "zod";
import type OpenAI from "openai";
import { GUARDRAILS } from "../guardrails/config.js";

export const searchCatalogParams = z.object({
  query: z.string().nullish().describe("Free-text search, e.g. 'chocolate cake'"),
  occasionTag: z.string().nullish().describe("Occasion tag such as 'birthday' or 'anniversary'"),
  category: z.string().nullish().describe("Product category such as 'cake' or 'cupcakes'"),
});

export const getProductDetailsParams = z.object({
  productId: z.string().describe("The product id returned by search_catalog"),
});

export const recommendProductParams = z.object({
  productId: z.string().describe("The product id being recommended"),
  variantId: z.string().describe("The specific variant id being recommended"),
  reason: z.string().min(1).describe("Why this product/variant fits what the customer asked for"),
});

export const suggestAddonParams = z.object({
  addOnId: z.string().describe("The add-on id to suggest, from get_product_details' availableAddOns"),
  reason: z.string().min(1).describe("Why this add-on complements the current order"),
});

export const suggestUpsellParams = z.object({
  productId: z.string().describe("The product id whose premium variant is being suggested"),
  variantId: z.string().describe("The premium variant id being suggested"),
  reason: z.string().min(1).describe("Why the premium variant is worth the extra cost"),
});

export const applyDiscountParams = z
  .object({
    percent: z.number().min(0).max(100).nullish().describe("Discount as a percentage of the order subtotal"),
    amountInPaise: z.number().int().min(0).nullish().describe("Discount as a flat amount in paise"),
    reasonCode: z.enum(GUARDRAILS.allowedDiscountReasonCodes).describe("Why this discount is justified"),
  })
  .refine((data) => data.percent != null || data.amountInPaise != null, {
    message: "Provide either percent or amountInPaise",
  });

export const presentOrderSummaryParams = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        variantId: z.string(),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1)
    .describe("The products/variants the customer has settled on"),
  addOnIds: z.array(z.string()).nullish().describe("Any add-ons the customer agreed to include"),
  discountRequestId: z
    .string()
    .nullish()
    .describe("The id returned by apply_discount, if a discount was applied to this order"),
});

export const toolDefinitions: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_catalog",
      description: "Search the bakery's product catalog by free text, occasion, or category.",
      parameters: z.toJSONSchema(searchCatalogParams),
    },
  },
  {
    type: "function",
    function: {
      name: "get_product_details",
      description:
        "Get full variant/pricing details for one product by id, plus any add-ons that pair with it.",
      parameters: z.toJSONSchema(getProductDetailsParams),
    },
  },
  {
    type: "function",
    function: {
      name: "recommend_product",
      description: "Record a specific product/variant recommendation made to the customer, with a reason.",
      parameters: z.toJSONSchema(recommendProductParams),
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_addon",
      description: "Suggest a complementary add-on (cross-sell) for the customer's current order.",
      parameters: z.toJSONSchema(suggestAddonParams),
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_upsell",
      description: "Suggest a premium/bigger variant instead of a standard one (upsell), with a reason.",
      parameters: z.toJSONSchema(suggestUpsellParams),
    },
  },
  {
    type: "function",
    function: {
      name: "apply_discount",
      description:
        "Request a discount for the customer, either as a percent or a flat amount, with a reason code. The amount actually applied may be lower than requested if it exceeds what you're authorized to give.",
      parameters: z.toJSONSchema(applyDiscountParams),
    },
  },
  {
    type: "function",
    function: {
      name: "present_order_summary",
      description:
        "Stage an order summary once the customer has settled on items. This does NOT charge anything - it only prepares a summary for the customer to review and confirm.",
      parameters: z.toJSONSchema(presentOrderSummaryParams),
    },
  },
];
