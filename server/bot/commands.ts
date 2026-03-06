import { SlashCommandBuilder } from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("bear")
    .setDescription("Bear signup commands.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("register")
        .setDescription("Register for bear.")
        .addNumberOption((option) =>
          option
            .setName("rally_size")
            .setDescription("Rally size.")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("group")
            .setDescription("Bear group.")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("profile")
            .setDescription("Select a profile.")
            .setRequired(false)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("edit")
        .setDescription("Edit bear signup.")
        .addNumberOption((option) =>
          option
            .setName("rally_size")
            .setDescription("Rally size.")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("group")
            .setDescription("Bear group.")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("profile")
            .setDescription("Select a profile.")
            .setRequired(false)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove bear signup.")
        .addStringOption((option) =>
          option
            .setName("group")
            .setDescription("Bear group.")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("profile")
            .setDescription("Select a profile.")
            .setRequired(false)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("View bear signup.")
        .addStringOption((option) =>
          option
            .setName("profile")
            .setDescription("Select a profile.")
            .setRequired(false)
            .setAutocomplete(true)
        )
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("vikings")
    .setDescription("Viking signup commands.")
    .toJSON(),
];
