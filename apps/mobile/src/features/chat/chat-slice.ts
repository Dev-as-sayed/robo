import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface ChatState {
  conversationId: string | null;
}

const initialState: ChatState = {
  conversationId: null,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setConversationId: (state, action: PayloadAction<string>) => {
      state.conversationId = action.payload;
    },
    startNewConversation: state => {
      state.conversationId = null;
    },
  },
});

export const { setConversationId, startNewConversation } = chatSlice.actions;
export const chatReducer = chatSlice.reducer;
