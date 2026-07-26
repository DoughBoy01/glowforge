import { CheckInForm } from "./check-in-form";

export const metadata = { title: "Check-in" };

export default function CheckInPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold tracking-tight md:mb-6">New check-in</h1>
      <CheckInForm />
    </div>
  );
}
