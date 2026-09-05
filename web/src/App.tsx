import { AuthScreen } from './components/AuthScreen';
import { PlayScreen } from './components/PlayScreen';
import { AuthProvider, useAuth } from './auth/AuthContext';

function Gate() {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <main className="boot">
        <p>Waking the grove…</p>
      </main>
    );
  }

  return user ? <PlayScreen /> : <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
