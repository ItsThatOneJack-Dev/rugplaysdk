export function composeGeckoForm(fields: Record<string, string>): {
    body: string;
    contentType: string;
} {
    const boundary =
        "----geckoformboundary" + Math.random().toString(16).slice(2);

    const body =
        Object.entries(fields)
            .map(
                ([name, value]) =>
                    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}`,
            )
            .join("\r\n") + `\r\n--${boundary}--`;

    return {
        body,
        contentType: `multipart/form-data; boundary=${boundary}`,
    };
}
