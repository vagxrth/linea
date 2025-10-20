import { Profile } from "@/types/user";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type ProfileState = Profile | null;
const initialState = null as ProfileState;

const slice = createSlice({
    name: "profile",
    initialState,
    reducers: {
        setProfile: (_, action: PayloadAction<Profile | null>) => action.payload,
        clearProfile: () => null as ProfileState,
    }
})

export const { setProfile, clearProfile } = slice.actions;
export default slice.reducer;