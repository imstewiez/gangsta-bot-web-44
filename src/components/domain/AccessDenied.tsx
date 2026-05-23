import { Crosshair } from "lucide-react";
import { Card } from "@/components/ui/card";

interface AccessDeniedProps {
  title?: string;
  description?: string;
}

export function AccessDenied({
  title = "Sem chave para esta porta.",
  description = "O armazém é assunto da chefia e do Patrão di Zona.",
}: AccessDeniedProps) {
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-destructive/10">
        <Crosshair className="h-5 w-5 text-destructive" />
      </div>
      <h2 className="text-display text-lg">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}
