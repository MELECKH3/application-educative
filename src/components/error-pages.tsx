import {
  Link,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <main className="grid min-h-svh place-items-center px-6 py-16">
      <div className="max-w-md space-y-6 text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Page introuvable
        </h1>
        <p className="text-muted-foreground">
          Cette page n’existe pas. Vérifie l’adresse ou reviens à l’accueil.
        </p>
        <Button asChild>
          <Link to="/">Retour à l’accueil</Link>
        </Button>
      </div>
    </main>
  )
}

export function RouteErrorPage({ reset }: ErrorComponentProps) {
  const router = useRouter()

  return (
    <main className="grid min-h-svh place-items-center px-6 py-16">
      <div className="max-w-md space-y-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Cette page n’a pas pu se charger
        </h1>
        <p role="alert" className="text-muted-foreground">
          Réessaie, ou reviens à l’accueil.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            onClick={() => {
              void router.invalidate()
              reset()
            }}
          >
            Réessayer
          </Button>
          <Button variant="outline" asChild>
            <a href="/">Retour à l’accueil</a>
          </Button>
        </div>
      </div>
    </main>
  )
}
