import type { Conversation } from "@/features/messaging/services/chat-api";

import { DUMMY_PROFILE_AVATAR_URI } from "@/constants/dummy-profile";

export const DUMMY_CONVERSATIONS: Conversation[] = [
  {
    _id: "dummy-conv-1",
    participants: [
      { id: "dummy-seller-1", name: "Alex Thompson", profileImageUrl: DUMMY_PROFILE_AVATAR_URI },
      { id: "me", name: "You" },
    ],
    lastMessage: {
      _id: "m1",
      content: "How's yesterday meet-up?",
      sender: "dummy-seller-1",
      createdAt: new Date().toISOString(),
    },
    unreadCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "dummy-conv-2",
    participants: [
      { id: "dummy-seller-2", name: "Priya Sharma", profileImageUrl: DUMMY_PROFILE_AVATAR_URI },
      { id: "me", name: "You" },
    ],
    lastMessage: {
      _id: "m2",
      content: "Is this still available?",
      sender: "dummy-seller-2",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    unreadCount: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "dummy-conv-3",
    participants: [
      { id: "dummy-seller-3", name: "Arjun Mehta", profileImageUrl: DUMMY_PROFILE_AVATAR_URI },
      { id: "me", name: "You" },
    ],
    lastMessage: {
      _id: "m3",
      content: "Thanks! I'll pick it up tomorrow.",
      sender: "me",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    unreadCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "dummy-conv-4",
    participants: [
      { id: "dummy-seller-4", name: "Sneha Reddy", profileImageUrl: DUMMY_PROFILE_AVATAR_URI },
      { id: "me", name: "You" },
    ],
    lastMessage: {
      _id: "m4",
      content: "Can you share more photos?",
      sender: "dummy-seller-4",
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
    unreadCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
