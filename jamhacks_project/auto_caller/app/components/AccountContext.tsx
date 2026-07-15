import { useContext, createContext, useState, ReactNode } from "react";

interface User {
    id: number;
    username: string;
    email: string;
    loggedIn: boolean;
}


interface AccountContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<void | string>;
    logout: () => void;
  }

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);

    // This is the login function thing
    const login = async (email: string, password: string) => {
        try {
            const response = await fetch("http://10.37.123.232:5001/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
                });
                
                const data = await response.json();
                if (response.ok) {
                    setUser({
                        id: data.id,
                        email: email,
                        username: data.username,
                        loggedIn: true,
                        });
                    } 
                else {
                    console.error("Login failed:", data.message);
                    return data.message
                }
                console.log("Login Response:", data);
        } catch (error) {
            console.error("Login Error:", error);
        }
    }

    const logout = () => {
        setUser(null);
    };
    return (
        <AccountContext.Provider value={{ user, login, logout }}>
          {children}
        </AccountContext.Provider>
    );
}


export const useAccountContext = () => {
    const context = useContext(AccountContext);
    if (!context) {
      throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
  };