import { PROBLEMS } from "@/lib/statics/appConstants";
import Logo from "./logo";
import Link from "next/link";

export default function Header({selectedPage}: {selectedPage: string}) {
    const links: {id: string, text: string, url: string}[] = [
        {id: "home", text: "Home", url: "/"}
    ].concat(Object.keys(PROBLEMS).map(problemId => {
        const problem = PROBLEMS[problemId];
        return {id: problemId, text: problem.name, url: problem.href};
    }))

    return (
    <div className="bg-secondary-100 dark:bg-secondary-900 flex flex-row items-stretch">
        <div className="p-3 pl-5">
            <Logo></Logo>
        </div>
        <nav className="ps-4 md:ps-16 hidden md:flex flex-row items-stretch">
            {links.map(link => {
                const selected: boolean = link.id === selectedPage;
                return (
                        <Link key={link.id} href={link.url} className={`h-full flex flex-col justify-center ${selected 
                            ? 'text-secondary dark:text-secondary-200 underline font-bold' 
                            : 'text-secondary dark:text-secondary-200'}`}>
                            <div className={`p-3 flex flex-col justify-around h-full ${selected ? 'bg-gradient-to-b from-secondary-100 to-primary-100 dark:from-secondary-900 dark:to-primary-900' : ''}`}>
                                {link.text}
                            </div>
                        </Link>
                )
            })}
        </nav>
    </div>
    )
}