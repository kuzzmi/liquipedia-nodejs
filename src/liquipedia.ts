import axios from "axios";
import htmlParse, { HTMLElement } from "node-html-parser";
import * as R from "rambda";

export interface Tournament {
  name: string;
  link: string;
}

export interface Match {
  team1: string;
  team2: string;
  format?: string;
  time?: number;
  tournament: Tournament;
}

export interface TournamentInfo {
  upcomingMatches: Match[];
  bracketMatches: Match[];
}

export interface TeamInfo {
  upcomingMatches: Match[];
}

export default (appName: string) => {
  const headers = {
    "User-Agent": appName,
    "Accept-Encoding": "gzip",
  };
  const baseUrl = "https://liquipedia.net/dota2/api.php";

  const parse = (page: string) => {
    return axios.get(baseUrl, {
      headers,
      params: {
        action: "parse",
        format: "json",
        page,
      },
    });
  };

  const parseTeamName = (table: HTMLElement, side: "left" | "right") => {
    const teamTitleLink = table.querySelector(
      `.team-${side} [class^='team-template-image-'] > a`
    );
    const team = teamTitleLink ? teamTitleLink.attrs.title : "TBD";
    return team;
  };

  const parseMatchTable: (table: HTMLElement) => Match = (table) => {
    const team1 = parseTeamName(table, "left");
    const team2 = parseTeamName(table, "right");
    const format = table.querySelector(".versus abbr")?.innerText;
    const time = +table.querySelector(
      ".timer-object.timer-object-countdown-only"
    ).attrs["data-timestamp"];

    const tournamentName = table.querySelector(".match-filler").innerText;

    return {
      team1,
      team2,
      format,
      time,
      tournament: {
        name: tournamentName,
        link: "",
      },
    };
  };

  const getUpcomingMatches = (html: HTMLElement) => {
    const matches = html
      .querySelectorAll(".infobox-header")
      .filter(
        (header: HTMLElement) => header.innerText.trim() === "Upcoming Matches"
      )
      .pop()
      ?.parentNode.parentNode.querySelectorAll("table")
      .map(parseMatchTable);
    return matches;
  };

  const getBracketMatches: (html: HTMLElement) => Match[] = (html) => {
    const matches = html
      .querySelectorAll(".bracket-game")
      .map((game: HTMLElement) => {
        const team1 =
          game
            .querySelector(".bracket-team-top")
            ?.querySelector(".team-template-team-bracket")
            ?.innerText.trim()
            .replace("&#160;", "") || "TBD";
        const team2 =
          game
            .querySelector(".bracket-team-bottom")
            ?.querySelector(".team-template-team-bracket")
            ?.innerText.trim()
            .replace("&#160;", "") || "TBD";
        const time =
          +game.querySelector(".timer-object")?.attrs["data-timestamp"] || 0;
        const matches = game.querySelectorAll(".bracket-popup-body-match")
          .length;
        return {
          team1,
          team2,
          format: `Bo${matches}`,
          time,
          tournament: {
            name: "",
            link: "",
          },
        };
      });
    return matches.filter((m: Match) => m.time !== 0);
  };

  const getTournamentInfo: (
    tournamentName: string
  ) => Promise<TournamentInfo> = async (tournamentName) => {
    try {
      const response = await parse(tournamentName);
      // console.log(response);
      const html = response.data.parse.text["*"];
      const parsedHtml = await htmlParse(html);

      return {
        upcomingMatches: getUpcomingMatches(parsedHtml),
        bracketMatches: getBracketMatches(parsedHtml),
      };
    } catch (e) {
      console.log(e);
      return e;
    }
  };

  const getTeamInfo: (teamName: string) => Promise<TeamInfo | null> = async (
    teamName
  ) => {
    try {
      const response = await parse(teamName);
      const html = response.data.parse.text["*"];
      const parsedHtml = await htmlParse(html);

      return {
        upcomingMatches: getUpcomingMatches(parsedHtml),
      };
    } catch (e) {
      console.log(e);
      return e;
    }
  };

  const getUpcomingAndOngoingMatches: () => Promise<Match[]> = async () => {
    try {
      const response = await parse("Liquipedia:Upcoming_and_ongoing_matches");
      const html = response.data.parse.text["*"];
      const parsedHtml = await htmlParse(html);

      const matchesRows = parsedHtml.querySelectorAll(
        "div[data-toggle-area-content='1'] > .wikitable"
      );
      const matches = matchesRows.map(parseMatchTable);

      return matches;
    } catch (e) {
      console.log(e);
      return e;
    }
  };

  return {
    getTournamentInfo,
    getTeamInfo,
    getUpcomingAndOngoingMatches,
  };
};
