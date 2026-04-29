"use client";

import { useState, useCallback } from "react";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { Upload, Download, ArrowRight, Check, X, Loader2 } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";

interface Field {
    key: string;
    label: string;
    required?: boolean;
}

interface ImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    fields: Field[];
    sampleCsvUrl: string;
    onImport: (data: any[]) => Promise<void>;
}

export function ImportDialog({
    open,
    onOpenChange,
    title,
    description,
    fields,
    sampleCsvUrl,
    onImport
}: ImportDialogProps) {
    const [step, setStep] = useState<"upload" | "mapping" | "preview">("upload");
    const [file, setFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvData, setCsvData] = useState<any[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        if (!selectedFile.name.endsWith(".csv")) {
            toast.error("Please upload a CSV file");
            return;
        }

        setFile(selectedFile);
        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as any[];
                if (data.length === 0) {
                    toast.error("CSV file is empty");
                    return;
                }
                const headers = Object.keys(data[0]);
                setCsvHeaders(headers);
                setCsvData(data);
                
                // Auto-map based on exact header names
                const initialMapping: Record<string, string> = {};
                fields.forEach(field => {
                    const match = headers.find(
                        header => header.toLowerCase() === field.label.toLowerCase() || 
                                 header.toLowerCase() === field.key.toLowerCase()
                    );
                    if (match) initialMapping[field.key] = match;
                });
                setMapping(initialMapping);
                setStep("mapping");
            },
            error: (error) => {
                toast.error("Failed to parse CSV: " + error.message);
            }
        });
    };

    const handleImport = async () => {
        setIsProcessing(true);
        try {
            const mappedData = csvData.map(row => {
                const item: any = {};
                Object.entries(mapping).forEach(([fieldKey, csvHeader]) => {
                    item[fieldKey] = row[csvHeader];
                });
                return item;
            });

            await onImport(mappedData);
            onOpenChange(false);
            reset();
        } catch (error: any) {
            toast.error(error.message || "Import failed");
        } finally {
            setIsProcessing(false);
        }
    };

    const reset = () => {
        setStep("upload");
        setFile(null);
        setCsvHeaders([]);
        setCsvData([]);
        setMapping({});
        setIsProcessing(false);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val);
            if (!val) reset();
        }}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                {step === "upload" && (
                    <div className="space-y-6 pt-4">
                        <div className="border-2 border-dashed border-zinc-200 rounded-lg p-12 text-center flex flex-col items-center gap-4 bg-zinc-50/50">
                            <Upload className="h-10 w-10 text-zinc-400" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium">Click to upload or drag and drop</p>
                                <p className="text-xs text-zinc-500">Only CSV files are supported</p>
                            </div>
                            <Input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                id="csv-upload"
                                onChange={handleFileUpload}
                            />
                            <Button asChild variant="outline">
                                <label htmlFor="csv-upload" className="cursor-pointer">
                                    Select File
                                </label>
                            </Button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-violet-50 rounded-lg border border-violet-100">
                            <div className="flex items-center gap-3">
                                <Download className="h-5 w-5 text-violet-600" />
                                <div>
                                    <p className="text-sm font-semibold text-violet-900">Need a template?</p>
                                    <p className="text-xs text-violet-700">Download our sample CSV to get started.</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" asChild className="text-violet-700 hover:text-violet-900 hover:bg-violet-100/50">
                                <a href={sampleCsvUrl} download>Download Sample</a>
                            </Button>
                        </div>
                    </div>
                )}

                {step === "mapping" && (
                    <div className="space-y-6 pt-4">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 px-4 py-2 border-b font-medium text-xs text-zinc-500 uppercase tracking-wider">
                                <div>Target Field</div>
                                <div>CSV Column Header</div>
                            </div>
                            {fields.map((field) => (
                                <div key={field.key} className="grid grid-cols-2 gap-4 items-center px-4 py-2">
                                    <Label className="flex items-center gap-2">
                                        {field.label}
                                        {field.required && <span className="text-destructive font-bold">*</span>}
                                    </Label>
                                    <Select 
                                        value={mapping[field.key] || "__skip__"} 
                                        onValueChange={(val) => setMapping(prev => ({ ...prev, [field.key]: val === "__skip__" ? "" : val }))}
                                    >
                                        <SelectTrigger className={!mapping[field.key] && field.required ? "border-destructive/50" : ""}>
                                            <SelectValue placeholder="Select column..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__skip__">-- Skip Field --</SelectItem>
                                            {csvHeaders.map(header => (
                                                <SelectItem key={header} value={header}>{header}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                        <DialogFooter className="border-t pt-4">
                            <Button variant="ghost" onClick={() => setStep("upload")}>Back</Button>
                            <Button 
                                onClick={() => setStep("preview")}
                                disabled={fields.some(f => f.required && !mapping[f.key])}
                            >
                                Preview Data
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </DialogFooter>
                    </div>
                )}

                {step === "preview" && (
                    <div className="space-y-6 pt-4">
                        <div className="rounded-lg border overflow-hidden max-h-[400px] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-zinc-50 sticky top-0 z-10">
                                    <TableRow>
                                        {fields.filter(f => mapping[f.key]).map(field => (
                                            <TableHead key={field.key} className="whitespace-nowrap">{field.label}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {csvData.slice(0, 10).map((row, i) => (
                                        <TableRow key={i}>
                                            {fields.filter(f => mapping[f.key]).map(field => (
                                                <TableCell key={field.key} className="max-w-[200px] truncate">
                                                    {row[mapping[field.key]]}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <p className="text-xs text-zinc-500 text-center">
                            Showing first 10 of {csvData.length} rows to be imported.
                        </p>
                        <DialogFooter className="border-t pt-4">
                            <Button variant="ghost" onClick={() => setStep("mapping")}>Back</Button>
                            <Button 
                                onClick={handleImport} 
                                disabled={isProcessing}
                                className="min-w-[120px]"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <Check className="mr-2 h-4 w-4" />
                                        Finalize Import
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
