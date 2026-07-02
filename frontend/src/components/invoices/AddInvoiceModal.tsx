import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface AddInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddInvoiceModal = ({ open, onOpenChange }: AddInvoiceModalProps) => {
  const [selectedMethod, setSelectedMethod] = useState<"upload" | "manual" | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">{t("addInvoiceModal.title")}</DialogTitle>
          <p className="text-muted-foreground text-center">
            {t("addInvoiceModal.subtitle")}
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 mt-6">
          {/* Upload Option */}
          <div
            onClick={() => setSelectedMethod("upload")}
            className={cn(
              "relative p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200",
              selectedMethod === "upload" 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <div className="absolute top-3 right-3">
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary text-primary-foreground">
                {t("addInvoiceModal.aiPowered")}
              </span>
            </div>
            
            <div className="flex flex-col items-center text-center pt-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">{t("addInvoiceModal.uploadTitle")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("addInvoiceModal.uploadDescription")}
              </p>
              <Button className="w-full" onClick={() => handleNavigate("/invoices/new/upload")}>
                {t("addInvoiceModal.uploadAction")}
              </Button>
            </div>
          </div>

          {/* Manual Entry Option */}
          <div
            onClick={() => setSelectedMethod("manual")}
            className={cn(
              "relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-200",
              selectedMethod === "manual" 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <div className="flex flex-col items-center text-center pt-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">{t("addInvoiceModal.manualTitle")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("addInvoiceModal.manualDescription")}
              </p>
              <Button variant="outline" className="w-full" onClick={() => handleNavigate("/invoices/new/manual")}>
                {t("addInvoiceModal.manualAction")}
              </Button>
            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
};
