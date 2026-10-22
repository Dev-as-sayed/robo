import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  bootstrapped: boolean;
}

const initialState: AuthState = {
  user: null,
  bootstrapped: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    clearUser: state => {
      state.user = null;
    },
    finishBootstrap: state => {
      state.bootstrapped = true;
    },
  },
});

export const { setUser, clearUser, finishBootstrap } = authSlice.actions;
export const authReducer = authSlice.reducer;
