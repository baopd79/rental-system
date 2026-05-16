import { UserButton } from "@clerk/nextjs";

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <UserButton />
      </div>
      <p className="text-gray-500">Chào mừng đến với hệ thống quản lý nhà trọ.</p>
    </div>
  );
}
