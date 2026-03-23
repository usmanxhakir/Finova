import { createClient } from "../supabase/client";

export interface ImportMapping {
    [key: string]: string; // csvHeader: targetField
}

export async function resolveAccount(nameOrCode: string) {
    const supabase = createClient();
    
    // Try to match by code first (e.g. "4000")
    const code = nameOrCode.split(" - ")[0].trim();
    
    const { data: matchedData, error } = await supabase
        .from("accounts")
        .select("id")
        .or(`code.eq.${code},name.ilike.%${nameOrCode}%`)
        .maybeSingle();
        
    if (error || !matchedData) {
        // Fallback: try to match just the name part if "Code - Name" format was used
        const namePart = nameOrCode.includes(" - ") ? nameOrCode.split(" - ")[1].trim() : nameOrCode;
        const { data: nameMatch, error: nameError } = await (supabase
            .from("accounts")
            .select("id")
            .ilike("name", `%${namePart}%`) as any)
            .maybeSingle();
        return (nameMatch as any)?.id || null;
    }

    return (matchedData as any)?.id || null;
}

export function parseCSV(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            // Basic CSV parsing if Papa is not available globally, 
            // but we installed papaparse so we should use it in the component.
            // This util will just be for secondary logic.
            resolve([]); 
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}
