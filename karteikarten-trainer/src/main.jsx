import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './flashcard.css'
import './decks.css'
import './concept.css'
import './tags.css'
import App from './App.jsx'
import { DataProvider } from './data/DataProvider.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { AcceptInviteScreen } from './auth/AcceptInviteScreen.jsx'

const inviteMatch = window.location.pathname.match(/^\/invite\/([^/]+)/)

function Root() {
  if (inviteMatch) {
    return (
      <AuthProvider>
        <AcceptInviteScreen inviteId={inviteMatch[1]} />
      </AuthProvider>
    )
  }

  return (
    <AuthProvider>
      <DataProvider>
        <App />
      </DataProvider>
    </AuthProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
