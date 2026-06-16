import type { Href } from "@/lib/safe-router";
import {
  getOrCreateConversation,
  makeOffer,
  type ProductThread,
} from "@/features/messaging/services/chat-api";

export type ListingChatInput = {
  recipientId: string;
  sellerId?: string;
  name?: string;
  contactImage?: string | null;
  productId: string;
  productType: string;
  productTitle?: string;
  productPrice?: number | string | null;
  productImage?: string | null;
  currency?: string;
};

/** Normalize route/search params — detail screens use listingId/listingType aliases. */
export function normalizeListingChatParams(params: Record<string, string | string[] | undefined>) {
  const pick = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  return {
    conversationId: pick("conversationId"),
    recipientId: pick("recipientId"),
    name: pick("name"),
    productId: pick("productId") ?? pick("listingId"),
    productType: pick("productType") ?? pick("listingType"),
    productTitle: pick("productTitle") ?? pick("listingTitle"),
    productPrice: pick("productPrice") ?? pick("listingPrice"),
    productImage: pick("productImage") ?? pick("listingImage"),
    currency: pick("currency"),
    sellerId: pick("sellerId"),
    contactImage: pick("contactImage"),
  };
}

export function buildListingChatHref(input: ListingChatInput): Href {
  return {
    pathname: "/chat-conversation",
    params: {
      recipientId: input.recipientId,
      name: input.name ?? "Seller",
      ...(input.contactImage ? { contactImage: input.contactImage } : {}),
      productId: input.productId,
      productType: input.productType,
      productTitle: input.productTitle ?? "",
      productPrice: input.productPrice != null ? String(input.productPrice) : "",
      productImage: input.productImage ?? "",
      currency: input.currency ?? "₹",
      sellerId: input.sellerId ?? input.recipientId,
    },
  } as Href;
}

export async function ensureListingThread(input: ListingChatInput): Promise<{
  conversationId: string;
  thread: ProductThread;
}> {
  const sellerId = input.sellerId ?? input.recipientId;
  const res = await getOrCreateConversation({
    recipientId: input.recipientId,
    sellerId,
    productId: input.productId,
    productType: input.productType,
    productTitle: input.productTitle,
    productPrice:
      input.productPrice != null && input.productPrice !== ""
        ? Number(input.productPrice)
        : undefined,
    productImage: input.productImage ?? undefined,
    currency: input.currency ?? "₹",
  });

  if (!res.thread?._id) {
    throw new Error("Could not open a product chat thread. Please try again.");
  }

  return {
    conversationId: res.conversation._id,
    thread: res.thread,
  };
}

export async function sendListingOffer(
  input: ListingChatInput,
  amount: number,
  currency = "₹",
) {
  const { thread } = await ensureListingThread(input);
  return makeOffer(thread._id, amount, currency);
}
