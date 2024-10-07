import React from 'react'
import { Routes,Route } from 'react-router-dom'
import Signup from './pages/Signup'
import { Chess } from 'chess.js'
import Login from './pages/Login'
const App = () => {
  return (
    <Routes>
      <Route
      path='/'
      element={<Chess/>}
      />
      <Route
      path='/Signup'
      element={<Signup/>}
      />
      <Route
      path='/login'
      element={<Login/>}
      />
    </Routes>
  )
}

export default App