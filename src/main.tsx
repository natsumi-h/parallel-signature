import '@mantine/core/styles.css'
import './index.css'
import { MantineProvider } from '@mantine/core'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

// StrictMode is not used because its double mount would initialize WebViewer twice
createRoot(document.getElementById('root')!).render(
  <MantineProvider>
    <App />
  </MantineProvider>,
)
