import { createSlice } from "@reduxjs/toolkit";

const userInitialState ={
    userData:null
}

const AuthReducer = createSlice({
    name:"Auth",
    initialState:userInitialState,
    reducers:{
        login:(state,action)=>{
            state.userData=action.payload
        }
    }

})

export const {login} =AuthReducer.actions;

export default AuthReducer.reducer