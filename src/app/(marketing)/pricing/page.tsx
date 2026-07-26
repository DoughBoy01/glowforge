import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PLANS } from "@/lib/constants";

export const metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-4xl px-safe py-16 [--gutter:1rem] md:py-20">
      <div className="mb-10 text-center md:mb-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple pricing</h1>
        <p className="mt-3 text-muted-foreground">
          Free covers the core habit. Pro unlocks full history and AI-assisted scoring.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        {Object.values(PLANS).map((plan) => (
          <Card key={plan.id} className={plan.id === "pro" ? "border-primary" : "border-border/60"}>
            <CardHeader>
              <CardTitle className="flex items-baseline gap-2 text-2xl">
                {plan.name}
              </CardTitle>
              <CardDescription>
                <span className="font-mono text-3xl font-bold text-foreground">
                  ${plan.priceMonthly}
                </span>
                <span className="text-muted-foreground">/mo</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <ul className="flex flex-col gap-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                size="lg"
                className="w-full"
                variant={plan.id === "pro" ? "default" : "outline"}
                render={<Link href="/sign-up">{plan.id === "pro" ? "Go Pro" : "Start free"}</Link>}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
