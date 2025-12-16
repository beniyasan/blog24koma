import { Routes, Route } from 'react-router-dom';
import { BlogPage } from './pages/BlogPage';
import { MoviePage } from './pages/MoviePage';
import { PricingPage } from './pages/PricingPage';
import './App.css';

function App() {
    return (
        <Routes>
            <Route path="/" element={<BlogPage />} />
            <Route path="/movie" element={<MoviePage />} />
            <Route path="/pricing" element={<PricingPage />} />
        </Routes>
    );
}

export default App;
