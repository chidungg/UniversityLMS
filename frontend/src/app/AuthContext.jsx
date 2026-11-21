import { createContext, useContext, useState, useCallback } from "react";

const defaultStudent = {
  _id: "1d0896ec8cc60f07c79dfeb1",
  email: "student01@lms-demo.test",
  fullName: "Alice Johnson",
  role: "Student",
  isActive: true,
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("lms_user");
    return saved ? JSON.parse(saved) : defaultStudent;
  });
  const [token, setToken] = useState(() => localStorage.getItem("lms_token") || "mock-student-token-2026");
  const [loading] = useState(false);

  const logout = useCallback(() => {
    setUser(defaultStudent);
    setToken("mock-student-token-2026");
    localStorage.removeItem("lms_token");
    localStorage.removeItem("lms_user");
  }, []);

  const login = useCallback(async (email, _password) => {
    const updatedUser = {
      ...defaultStudent,
      email: email || defaultStudent.email,
    };
    setUser(updatedUser);
    setToken("mock-student-token-2026");
    localStorage.setItem("lms_user", JSON.stringify(updatedUser));
    localStorage.setItem("lms_token", "mock-student-token-2026");
    return updatedUser;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated: true,
        isStudent: true,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
