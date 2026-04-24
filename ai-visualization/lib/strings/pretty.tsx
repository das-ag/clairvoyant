import { toast } from "react-toastify";

export function capitalize(s : string) {
    return (s.split(" ").map(sub => sub.charAt(0).toUpperCase() + sub.slice(1))).join(" ");
}

export function renderValue(value: any, prefix: string = "", suffix: string = "", key: any = 0) {
    let extraClasses = ["font-mono"];
    let str = JSON.stringify(value);
    //console.log("Value: ", value, "Str: ", str);
    if (value === undefined || value === null) {
        extraClasses.push("text-code-null");
        str = value === undefined ? "undefined" : "null";
    }
    else if (typeof value === "boolean") {
        extraClasses.push("text-code-boolean");
    }
    else if (typeof value === "number") {
        extraClasses.push("text-code-number");
    }
    else if (typeof value === "string") {
        extraClasses.push("text-code-string");
        let lines = value.split("\n");
        if (lines.length > 1) {
            return (
                <span>
                    {prefix}
                    <span className={extraClasses.join(" ")}>
                        {lines.map((line, i) => {
                            let separator = i === lines.length - 1 ? "" : "\n";
                            return (
                                <p key={i}>{line}{separator}</p>
                            )
                        })}
                    </span>
                    {suffix}
                </span>
            );
        }
    }

    let result = (
        <span key={key}>{prefix}<span className={extraClasses.join(" ")}>{str}</span>{suffix}</span>
    )
    //console.log(result)
    return result;
}

export function formatPrettyFile(filename: string) {
    return capitalize(filename.replace(/^\d+_/, "").replace(/_/g, " ").replace(/\..*$/, ""));
}