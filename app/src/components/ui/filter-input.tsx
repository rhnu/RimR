import { Input } from '@/components/ui/input';

type FilterInputProps = {
  value: string;
  label: string;
  onValueChange: (value: string) => void;
  className?: string;
};

export function FilterInput({ value, label, onValueChange, className }: FilterInputProps) {
  return (
    <Input
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      placeholder={label}
      aria-label={label}
      className={className}
    />
  );
}
