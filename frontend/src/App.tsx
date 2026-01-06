import { Routes, Route } from 'react-router-dom';
import { BlogPage } from './pages/BlogPage';
import { MoviePage } from './pages/MoviePage';
import { CustomPage } from './pages/CustomPage';
import { PricingPage } from './pages/PricingPage';
import { HowtoPage } from './pages/HowtoPage';
import { IntroductionPage } from './pages/IntroductionPage';
import { SubscriptionSuccessPage } from './pages/SubscriptionSuccessPage';
import { TitleManager } from './components/TitleManager';
import './App.css';

function App() {
    return (
        <>
            <TitleManager />
            <Routes>
                <Route path="/" element={<BlogPage />} />
                <Route path="/movie" element={<MoviePage />} />
                <Route path="/custom" element={<CustomPage />} />
                <Route path="/introduction" element={<IntroductionPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/howto" element={<HowtoPage />} />
                <Route path="/subscription/success" element={<SubscriptionSuccessPage />} />
            </Routes>
        </>
    );
}

export default App;
