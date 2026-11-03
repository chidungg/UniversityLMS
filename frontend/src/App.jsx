import { useEffect } from "react";

function App() {
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch("/api/health");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message);
        }

        console.log("MERN connection successful:", data);
      } catch (error) {
        console.error("Connection failed:", error);
      }
    };

    checkConnection();
  }, []);

  return null;
}

export default App;