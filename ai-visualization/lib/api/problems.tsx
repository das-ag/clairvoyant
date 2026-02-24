import { API_URL } from "../statics/appConstants"

export async function getApiObject<T>(url: string, defaultVal: T): Promise<T> {
    let result = defaultVal;
    try {
        let response = await fetch(url)
        let json = await response.json()
        result = json as T
        if (result === undefined) {
            console.error(`Received empty result from ${url}, json: ${json}`)
        }
    } catch (err) {
        console.error(err);
    }
    return result;
}

export async function getCases(problem: string): Promise<string[]> {
    return await getApiObject<string[]>(`${API_URL}/${problem}/cases`, [])
}

export async function getSolutions(problem: string): Promise<string[]> {
    return await getApiObject<string[]>(`${API_URL}/${problem}/algorithms`, [])
}

export async function getCase(problem: string, caseId: string): Promise<string> {
    return await getApiObject<string>(`${API_URL}/${problem}/cases/${caseId}`, "")
}

export async function getSolution(problem: string, solutionId: string): Promise<string> {
    return await getApiObject<string>(`${API_URL}/${problem}/algorithms/${solutionId}`, "")
}

export async function getAnnotations(problem: string, solutionId: string): Promise<any[]> {
    return await getApiObject<any[]>(`${API_URL}/${problem}/algorithms/${solutionId}/annotations`, [])
}