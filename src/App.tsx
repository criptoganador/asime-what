import { Layout } from './components/Layout'
import { AuthScreen } from './features/auth/components/AuthScreen'
import { useChatStore } from './features/sidebar/store/useChatStore'

function App() {
  const { isAuthenticated } = useChatStore();

  return (
    <>
      {!isAuthenticated ? <AuthScreen /> : <Layout />}
    </>
  )
}

export default App
