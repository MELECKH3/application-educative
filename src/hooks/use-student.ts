import { useRouteContext } from '@tanstack/react-router'
export function useStudent() {
  return useRouteContext({ from: '/_app' }).account.profile
}
