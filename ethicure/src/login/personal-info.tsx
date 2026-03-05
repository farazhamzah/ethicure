import runner from "@/assets/runner.png"
import { PersonalInfoForm } from "../components/personal-info-form"
import { ThemeToggle } from "../components/theme-toggle"

export default function PersonalInfoPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center md:justify-center">
          <span className="font-semibold text-lg">Ethicure</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <PersonalInfoForm />
            <div className="mt-6 flex justify-center">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          src={runner}
          alt="Image"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.5] dark:grayscale"
        />
      </div>
    </div>
  )
}
