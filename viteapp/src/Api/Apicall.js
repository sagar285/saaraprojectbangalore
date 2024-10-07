import { Apifetchrequest } from "./Axios";
import { Backend_url } from "./BackendUrl";

export const registerapi=async(data)=>{
    return await Apifetchrequest("POST",`${Backend_url}/user/auth/signup`,data)
}