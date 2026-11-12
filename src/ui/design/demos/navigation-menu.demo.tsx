import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "#/ui/components/ui/navigation-menu"

import { type DemoMeta } from "../demo"

export const meta: DemoMeta = { title: "Navigation menu", components: ["navigation-menu"] }

export default function NavigationMenuDemo() {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Views</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-56 gap-1 p-1">
              <li>
                <NavigationMenuLink href="#">Scatter</NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink href="#">Bars</NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink href="#">3D</NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#">Leaderboard</NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}
