import { SlashCommandBuilder } from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link a Kingshot profile.")
    .addStringOption((option) =>
      option
        .setName("player_id")
        .setDescription("Kingshot player ID.")
        .setRequired(true)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("bear")
    .setDescription("Bear signup commands.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("register")
        .setDescription("Register for bear.")
        .addStringOption((option) =>
          option
            .setName("group")
            .setDescription("Bear group.")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addNumberOption((option) =>
          option
            .setName("rally_size")
            .setDescription("Rally size.")
            .setRequired(false)
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
        .addStringOption((option) =>
          option
            .setName("group")
            .setDescription("Bear group.")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addNumberOption((option) =>
          option
            .setName("rally_size")
            .setDescription("Rally size.")
            .setRequired(false)
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
    .addSubcommand((subcommand) =>
      subcommand
        .setName("register")
        .setDescription("Register for vikings.")
        .addNumberOption((option) =>
          option
            .setName("march_count")
            .setDescription("March count.")
            .setRequired(true)
        )
        .addNumberOption((option) =>
          option
            .setName("troop_count")
            .setDescription("Troop count.")
            .setRequired(false)
        )
        .addNumberOption((option) =>
          option
            .setName("power")
            .setDescription("Power.")
            .setRequired(false)
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
        .setDescription("Edit viking signup.")
        .addNumberOption((option) =>
          option
            .setName("march_count")
            .setDescription("March count.")
            .setRequired(true)
        )
        .addNumberOption((option) =>
          option
            .setName("troop_count")
            .setDescription("Troop count.")
            .setRequired(false)
        )
        .addNumberOption((option) =>
          option
            .setName("power")
            .setDescription("Power.")
            .setRequired(false)
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
        .setDescription("Remove viking signup.")
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
        .setName("assignments")
        .setDescription("Get your viking assignments.")
        .addStringOption((option) =>
          option
            .setName("output")
            .setDescription("Where to send assignments.")
            .setRequired(false)
            .addChoices(
              { name: "DM", value: "dm" },
              { name: "Channel", value: "channel" }
            )
        )
        .addStringOption((option) =>
          option
            .setName("profile")
            .setDescription("Select a profile.")
            .setRequired(false)
            .setAutocomplete(true)
        )
    )
    .toJSON(),
];
