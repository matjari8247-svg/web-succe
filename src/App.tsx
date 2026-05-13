import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import HomePage from "./pages/Home/Home"

function AppRoutes() {
    const location = useLocation();

    return (

            <Routes key={location.pathname} >
            <Route path="/" element={<HomePage />} />
            <Route path="/HomePage" element={<HomePage />} />
            </Routes>
            
    );
}

function App() {
    return (
        <Router>
            <div className="app">
                <AppRoutes />
            </div>
        </Router>
    );
}

export default App;
