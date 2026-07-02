import Masthead from './components/Masthead'
import Feed from './components/Feed'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="page">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Masthead />
      <Feed />
      <Footer />
    </div>
  )
}
