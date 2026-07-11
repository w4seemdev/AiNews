import { useState } from 'react'
import Masthead from './components/Masthead'
import Feed from './components/Feed'
import Footer from './components/Footer'

export default function App() {
  // Last successful data refresh (ISO). Reported up by Feed once it knows.
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  return (
    <div className="page">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Masthead updatedAt={updatedAt} />
      <Feed onFreshness={setUpdatedAt} />
      <Footer />
    </div>
  )
}
