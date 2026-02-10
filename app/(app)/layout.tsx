import AppLayout from "../../components/layout/AppLayout";
import { AppearanceProvider } from "../../components/providers/AppearanceProvider";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppearanceProvider>
      <AppLayout>{children}</AppLayout>
    </AppearanceProvider>
  );
}
