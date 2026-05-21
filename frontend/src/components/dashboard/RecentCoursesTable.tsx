import type { RecentCourse, UserCourses } from '@/types';

type RecentCourseRow = RecentCourse | UserCourses;

export function RecentCoursesTable({ courses }: { courses: RecentCourseRow[] }) {
    return (
        <div className="flex-1 rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 text-lg font-semibold text-foreground">Recent Activity</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="py-2 pr-4 text-left font-medium text-muted-foreground">
                                Course
                            </th>
                            <th className="py-2 pr-4 text-left font-medium text-muted-foreground">
                                Provider
                            </th>
                            <th className="py-2 text-right font-medium text-muted-foreground">
                                Progress
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {courses.map((course, idx) => (
                            <tr key={idx} className="border-b border-border last:border-0">
                                <td className="py-3 pr-4 font-medium text-foreground">
                                    <a
                                        href={course.external_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline"
                                    >
                                        {course.course_name}
                                    </a>
                                </td>
                                <td className="py-3 pr-4 text-muted-foreground">
                                    {course.provider_platform_name}
                                </td>
                                <td className="py-3 text-right text-muted-foreground">
                                    {Math.floor(course.course_progress)}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
