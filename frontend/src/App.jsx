import SignIn from "./components/SignIn.jsx";
import SignUp from "./components/SignUp.jsx"
import Hero from "./components/Hero.jsx"
import { useEffect, useState } from "react";
import axios from "axios";
import {Routes, Route, Navigate,  BrowserRouter as Router } from "react-router-dom"

const App = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get("/api/auth/me");
        setUser(response.data)
      } catch (error) {
        setUser(null)
      }
    }
    fetchUser()
  }, [])

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={<Hero user={user} />}
        />
        <Route 
          path="/signup" 
          element={user ? <Navigate to="/" /> : <SignUp setUser={setUser} />}
        />
        <Route 
          path="/login" 
          element={user ? <Navigate to="/" /> : <SignIn setUser={setUser} />}
        />

      </Routes>
    </Router>
  );
}

export default App;
