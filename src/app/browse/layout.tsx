// /browse is a client page, which cannot export route config itself, so its
// revalidation interval lives on this pass-through layout.
export const revalidate = 3600;

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
