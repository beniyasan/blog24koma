import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { LanguageProvider } from './providers/LanguageProvider'
import { RuntimeConfigProvider } from './providers/RuntimeConfigProvider'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <RuntimeConfigProvider>
            <LanguageProvider>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </LanguageProvider>
        </RuntimeConfigProvider>
    </React.StrictMode>,
)
