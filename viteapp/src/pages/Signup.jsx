import React, { useState } from 'react'
import "../styles/Signup.css"
import { registerapi } from '../Api/Apicall'

const Signup = () => {
  const [phoneNumber,setphoneNumber]=useState()
  const [username,setusername]=useState("")
  const [Error,setError]=useState(false)
  const [ErrorMsg,setErrorMsg]=useState(false)



  const isPhoneNumber = (value) => {
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(value);
  };

  const onChangeHandler=(e)=>{
     const {name,value}=e.target;
     if(name == "phone"){
         setphoneNumber(value)
       
     }
     else{
      setusername(value)
     }

  }

  const HandleSubmit =async(e)=>{
    e.preventDefault();
    const test=isPhoneNumber(phoneNumber)
    console.log(test)
    if(!test)
      {
        setError(true)
        setErrorMsg("please enter a valid number")
      }
      const data ={
        username:username,
        phoneNumber:phoneNumber
      }
    const response = await registerapi(data)
    console.log(response)
  }


  return (
    <div className='MainDiv'>
        <form className='form' onSubmit={HandleSubmit}>
            <input type="text" value={username} name='username' placeholder=' Enter username' className='inputs' onChange={onChangeHandler} />
            <input type="tel" value={phoneNumber}  maxLength={10} name="phone"  placeholder='Enter number' className='inputs'  onChange={onChangeHandler} />
            <button  className='button' >Submit</button>
        </form>
    </div>
  )
}

export default Signup