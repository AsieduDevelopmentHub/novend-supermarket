import { FULLY_OFFLINE } from "@/constants/runtime";
import { MilliesUsersView } from "@/features/users/components/millies-users-view";
import { UsersView } from "@/features/users/components/users-view";

export default function UsersPage() {
  if (FULLY_OFFLINE) return <MilliesUsersView />;
  return <UsersView />;
}
