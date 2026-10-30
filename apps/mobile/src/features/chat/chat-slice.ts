import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface ChatState {
  conversationId: string | null;
  resumeLatest: boolean;
}

const initialState: ChatState = {
  conversationId: null,
  resumeLatest: true,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setConversationId: (state, action: PayloadAction<string>) => {
      state.conversationId = action.payload;
      state.resumeLatest = true;
    },
    startNewConversation: state => {
      state.conversationId = null;
      state.resumeLatest = false;
    },
  },
});

export const { setConversationId, startNewConversation } = chatSlice.actions;
export const chatReducer = chatSlice.reducer;
