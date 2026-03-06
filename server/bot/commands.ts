import { SlashCommandBuilder } from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("bear")
    .setDescription("Bear signup commands.")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("vikings")
    .setDescription("Viking signup commands.")
    .toJSON(),
];
