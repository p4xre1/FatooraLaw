import { useId, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Field, Input } from "../../../components/kit"
import { useTranslation } from "../language/useLanguage"
import { MAX_PASSWORD_LENGTH } from "../lib/validation"

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder = "••••••••",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: "current-password" | "new-password"
  placeholder?: string
}) {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)
  const inputId = useId()

  return (
    <Field label={label}>
      <div className="relative">
        <Input
          id={inputId}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={MAX_PASSWORD_LENGTH}
          spellCheck={false}
          autoCapitalize="off"
          className="pe-10"
          required
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? t.common.hidePassword : t.common.showPassword}
          className="absolute inset-y-0 end-0 grid w-9 place-items-center text-faint transition-colors hover:text-muted"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  )
}
